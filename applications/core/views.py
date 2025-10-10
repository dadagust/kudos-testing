from auditlog.models import LogEntry
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserProfile
from .serializers import (
    AuditLogEntrySerializer,
    AuthResponseSerializer,
    LoginSerializer,
    UserProfileSerializer,
)


@api_view(['GET'])
@permission_classes([AllowAny])
def ping(request):
    return Response({'status': 'ok'})


class AuthMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, 'profile', None)
        if profile is None:
            profile, _ = UserProfile.objects.get_or_create(user=request.user)
        data = UserProfileSerializer(profile).data
        return Response(data)


class AuthLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        profile, _ = UserProfile.objects.get_or_create(user=user)

        payload = {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': profile,
        }
        response_serializer = AuthResponseSerializer(payload)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class AuthLogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Токены не храним на сервере на этом этапе, фронт сбрасывает их самостоятельно.
        return Response({'detail': 'Logged out'}, status=status.HTTP_200_OK)


class AuditLogListView(ListAPIView):
    serializer_class = AuditLogEntrySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        queryset = LogEntry.objects.select_related('actor', 'content_type').order_by('-timestamp')

        action_param = self.request.query_params.get('action')
        if action_param:
            action_lookup = {label.lower(): value for value, label in LogEntry.Action.choices}
            action_value = action_lookup.get(action_param.lower())
            if action_value is not None:
                queryset = queryset.filter(action=action_value)

        model_param = self.request.query_params.get('model')
        if model_param:
            queryset = queryset.filter(content_type__model=model_param.lower())

        actor_param = self.request.query_params.get('actor')
        if actor_param:
            queryset = queryset.filter(
                Q(actor__email__icontains=actor_param) | Q(actor__username__icontains=actor_param)
            )

        search_param = self.request.query_params.get('search')
        if search_param:
            queryset = queryset.filter(
                Q(object_repr__icontains=search_param) | Q(object_pk__icontains=search_param)
            )

        limit_param = self.request.query_params.get('limit')
        if limit_param:
            try:
                limit = int(limit_param)
            except (TypeError, ValueError):
                limit = None
            if limit is not None and limit > 0:
                queryset = queryset[: min(limit, 500)]

        return queryset

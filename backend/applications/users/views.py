from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserProfile
from .serializers import AuthResponseSerializer, LoginSerializer, UserProfileSerializer


class AuthMeView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        profile = getattr(request.user, 'profile', None)
        if profile is None:
            profile, _ = UserProfile.objects.get_or_create(user=request.user)
        data = UserProfileSerializer(profile).data
        return Response(data)


class AuthLoginView(APIView):
    permission_classes = (AllowAny,)

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
        return Response(
            response_serializer.data,
            status=status.HTTP_200_OK,
        )


class AuthLogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        # Токены не храним на сервере на этом этапе, фронт сбрасывает их самостоятельно.
        return Response(
            {'detail': 'Logged out'},
            status=status.HTTP_200_OK,
        )


class AuthRefreshView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        refresh_token = request.data.get('refresh')

        if not refresh_token:
            return Response(
                {'detail': 'Refresh token is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            refresh = RefreshToken(refresh_token)
        except TokenError:
            return Response(
                {'detail': 'Invalid or expired refresh token'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user_id = refresh.get('user_id')

        if user_id is None:
            return Response(
                {'detail': 'Invalid token payload'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user_model = get_user_model()
        try:
            user = user_model.objects.get(id=user_id)
        except user_model.DoesNotExist:
            return Response(
                {'detail': 'User not found'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        profile, _ = UserProfile.objects.get_or_create(user=user)

        payload = {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': profile,
        }

        response_serializer = AuthResponseSerializer(payload)
        return Response(
            response_serializer.data,
            status=status.HTTP_200_OK,
        )

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserProfile
from .serializers import AuthResponseSerializer, LoginSerializer, UserProfileSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def ping(request):
    return Response({"status": "ok"})


class AuthMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "profile", None)
        if profile is None:
            profile, _ = UserProfile.objects.get_or_create(user=request.user)
        data = UserProfileSerializer(profile).data
        return Response(data)


class AuthLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)
        profile, _ = UserProfile.objects.get_or_create(user=user)

        payload = {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": profile,
        }
        response_serializer = AuthResponseSerializer(payload)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class AuthLogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Токены не храним на сервере на этом этапе, фронт сбрасывает их самостоятельно.
        return Response({"detail": "Logged out"}, status=status.HTTP_200_OK)

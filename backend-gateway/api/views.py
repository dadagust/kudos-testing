from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

@api_view(["GET"])
@permission_classes([AllowAny])
def ping(request):
    return Response({"status": "ok"})

class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response({"id": u.id, "username": u.get_username(), "email": u.email})

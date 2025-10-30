from django.contrib.auth import authenticate, get_user_model
from django.db.utils import DatabaseError, OperationalError, ProgrammingError
from rest_framework import serializers

from .models import LEGACY_ROLE_MAP, RoleChoices, UserProfile
from .permissions import serialize_user_permissions


class UserProfileSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='user.id')
    email = serializers.EmailField(source='user.email')
    full_name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = (
            'id',
            'email',
            'full_name',
            'role',
            'permissions',
        )

    def get_full_name(self, obj: UserProfile) -> str:
        return obj.user.get_full_name() or obj.user.email

    def get_role(self, obj: UserProfile) -> str:
        value = obj.role
        if value in RoleChoices.values:
            return value

        legacy = LEGACY_ROLE_MAP.get(value)
        return legacy if legacy else str(value)

    def get_permissions(self, obj: UserProfile) -> list[str]:
        return serialize_user_permissions(obj.user)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        user_model = get_user_model()

        try:
            user_obj = user_model.objects.get(email=email)
            username = user_obj.get_username()
        except user_model.DoesNotExist:
            username = email
        except (OperationalError, ProgrammingError, DatabaseError) as exc:
            raise serializers.ValidationError(
                'Сервис авторизации временно недоступен. Повторите попытку позже.'
            ) from exc

        user = authenticate(username=username, password=password)
        if not user:
            raise serializers.ValidationError('Неверный email или пароль')

        attrs['user'] = user
        return attrs


class AuthResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserProfileSerializer(read_only=True)

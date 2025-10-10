from auditlog.models import LogEntry
from django.contrib.auth import authenticate, get_user_model
from django.db import DatabaseError, OperationalError, ProgrammingError
from rest_framework import serializers

from .constants import ADMIN_SECTIONS, ROLE_ACCESS_MATRIX
from .models import LEGACY_ROLE_MAP, RoleChoices, UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='user.id')
    email = serializers.EmailField(source='user.email')
    full_name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    access = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ('id', 'email', 'full_name', 'role', 'access')

    def get_full_name(self, obj: UserProfile) -> str:
        return obj.user.get_full_name() or obj.user.email

    def get_role(self, obj: UserProfile) -> str:
        value = obj.role
        if value in RoleChoices.values:
            return value

        legacy = LEGACY_ROLE_MAP.get(value)
        return legacy if legacy else str(value)

    def get_access(self, obj: UserProfile) -> dict[str, bool]:
        role_key = self.get_role(obj)
        allowed = set(ROLE_ACCESS_MATRIX.get(role_key, []))
        sections = ADMIN_SECTIONS
        return {section: section in allowed for section in sections}


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


class AuditLogEntrySerializer(serializers.ModelSerializer):
    action = serializers.SerializerMethodField()
    actor = serializers.SerializerMethodField()
    content_type = serializers.SerializerMethodField()
    object_id = serializers.CharField(source='object_pk')
    changes = serializers.SerializerMethodField()
    changes_display = serializers.SerializerMethodField()

    class Meta:
        model = LogEntry
        fields = (
            'id',
            'timestamp',
            'action',
            'actor',
            'remote_addr',
            'content_type',
            'object_id',
            'object_repr',
            'changes',
            'changes_display',
            'additional_data',
        )

    def get_action(self, obj: LogEntry) -> str:
        label = obj.get_action_display()
        return str(label).lower() if label else str(obj.action)

    def get_actor(self, obj: LogEntry) -> dict[str, str | int] | None:
        if not obj.actor:
            return None

        full_name = obj.actor.get_full_name() or obj.actor.get_username() or obj.actor.email
        return {
            'id': obj.actor.pk,
            'email': obj.actor.email or '',
            'full_name': full_name,
        }

    def get_content_type(self, obj: LogEntry) -> dict[str, str] | None:
        if not obj.content_type:
            return None

        return {
            'app_label': obj.content_type.app_label,
            'model': obj.content_type.model,
            'name': obj.content_type.name,
        }

    def get_changes(self, obj: LogEntry) -> dict:
        try:
            return obj.changes_dict or {}
        except AttributeError:
            return obj.changes or {}

    def get_changes_display(self, obj: LogEntry) -> dict:
        try:
            return obj.changes_display_dict or {}
        except AttributeError:
            return {}

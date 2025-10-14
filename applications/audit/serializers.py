from auditlog.models import LogEntry
from rest_framework import serializers


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

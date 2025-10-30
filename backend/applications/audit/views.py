from auditlog.models import LogEntry
from django.db.models import Q
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from .serializers import AuditLogEntrySerializer


class AuditLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
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

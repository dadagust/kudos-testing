export type PermissionCode = string;

const VIEW_SEGMENT = '_view_';
const CHANGE_SEGMENT = '_change_';

const isViewPermission = (permission: PermissionCode) => permission.includes(VIEW_SEGMENT);

const inferChangePermission = (permission: PermissionCode) =>
  isViewPermission(permission) ? permission.replace(VIEW_SEGMENT, CHANGE_SEGMENT) : null;

export const hasPermission = (
  permissions: PermissionCode[] | null | undefined,
  required: PermissionCode
) => {
  if (!permissions?.length) {
    return false;
  }

  if (permissions.includes(required)) {
    return true;
  }

  if (isViewPermission(required)) {
    const impliedChange = inferChangePermission(required);
    if (impliedChange && permissions.includes(impliedChange)) {
      return true;
    }
  }

  return false;
};

export const AuditAction = {
  UserCreated: 'USER_CREATED',
  UserUpdated: 'USER_UPDATED',
  UserDeactivated: 'USER_DEACTIVATED',
  UserReactivated: 'USER_REACTIVATED',
  PasswordReset: 'PASSWORD_RESET',
  BuildingCreated: 'BUILDING_CREATED',
  BuildingUpdated: 'BUILDING_UPDATED',
  GroupCreated: 'GROUP_CREATED',
  GroupUpdated: 'GROUP_UPDATED',
  GroupDeactivated: 'GROUP_DEACTIVATED',
  UserAddedToGroup: 'USER_ADDED_TO_GROUP',
  UserRemovedFromGroup: 'USER_REMOVED_FROM_GROUP',
} as const;

export const AuditEntity = {
  User: 'User',
  Building: 'Building',
  Group: 'Group',
  GroupMembership: 'GroupMembership',
} as const;

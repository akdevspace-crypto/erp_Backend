const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const getMenuPrivilege = (metadata) => {
    if (!isObject(metadata)) return null;

    const menuPrivilege = metadata.menuPrivilege;
    return isObject(menuPrivilege) ? menuPrivilege : null;
};

const isAdminRole = (roleName) => {
    const normalizedRole = String(roleName || '').trim().toLowerCase();
    return normalizedRole === 'admin' || normalizedRole === 'super admin' || normalizedRole === 'superadmin';
};

export const resolveUserAccess = (user) => {
    if (isAdminRole(user?.role?.name)) {
        return {
            permissions: ['ALL_ACCESS'],
            unitAccess: ['*'],
            menuPrivilege: null
        };
    }

    const menuPrivilege = getMenuPrivilege(user?.staff?.metadata);
    const permissionsMap = isObject(menuPrivilege?.permissions) ? menuPrivilege.permissions : {};
    const permissions = Object.entries(permissionsMap)
        .filter(([, permission]) => isObject(permission) && (permission.view || permission.createUpdate))
        .map(([permissionName]) => permissionName);

    const selectedUnitIds = Array.isArray(menuPrivilege?.selectedUnitIds)
        ? menuPrivilege.selectedUnitIds.filter((unitId) => typeof unitId === 'string' && unitId.trim().length > 0)
        : [];

    const unitAccess = menuPrivilege?.unitAccessMode === 'all'
        ? ['*']
        : (selectedUnitIds.length > 0 ? selectedUnitIds : [user?.unitId].filter(Boolean));

    return {
        permissions,
        unitAccess,
        menuPrivilege
    };
};

export const buildSessionUser = (user) => {
    const access = resolveUserAccess(user);

    return {
        id: user.id,
        email: user.email,
        mobile: user.mobile || null,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName || ''}`.trim(),
        role: user.role ? {
            id: user.role.id,
            name: user.role.name
        } : null,
        tenantId: user.tenantId,
        unitId: user.unitId,
        unit: user.unit ? {
            id: user.unit.id,
            name: user.unit.name,
            code: user.unit.code
        } : null,
        permissions: access.permissions,
        unitAccess: access.unitAccess,
        menuPrivilege: access.menuPrivilege
    };
};

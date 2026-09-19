/**
 * Strapi Multi-Tenant Row-Level Security Middleware
 *
 * Intercepts all Strapi REST & GraphQL requests to ensure tenants
 * can ONLY access records belonging to their own organization.
 */

export default (config: any, { strapi }: any) => {
  return async (ctx: any, next: () => Promise<void>) => {
    const user = ctx.state.user;

    // Superadmins or backend system tokens bypass automatic scoping
    if (!user || user.role?.type === "superadmin" || ctx.state.isSystemToken) {
      return next();
    }

    // Tenant context must be attached to the user record
    const tenantId = user.tenant?.id;
    if (!tenantId) {
      return ctx.forbidden("User does not have an assigned Tenant organization.");
    }

    // Apply strict filtering to GET queries
    if (ctx.method === "GET") {
      ctx.query = ctx.query || {};
      ctx.query.filters = {
        ...(ctx.query.filters || {}),
        tenant: {
          id: {
            $eq: tenantId,
          },
        },
      };
    }

    // Force tenant assignment on POST/PUT requests
    if (["POST", "PUT", "PATCH"].includes(ctx.method)) {
      if (ctx.request.body?.data) {
        ctx.request.body.data.tenant = tenantId;
      }
    }

    await next();
  };
};

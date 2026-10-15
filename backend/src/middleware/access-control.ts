type AuthenticatedRequest = {
  isAuthenticated?: boolean;
  user?: { id: string };
};

export function hasAuthenticatedSession(req: AuthenticatedRequest) {
  return Boolean(req.isAuthenticated && req.user?.id);
}
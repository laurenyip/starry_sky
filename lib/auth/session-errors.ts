/**
 * Detects errors from getSession / token refresh when the stored refresh token
 * is no longer valid (revoked, expired, project reset, etc.).
 */
export function isInvalidRefreshTokenError(
  error: { message?: string | null } | null | undefined
): boolean {
  const m = error?.message?.toLowerCase() ?? ''
  return (
    m.includes('invalid refresh token') ||
    m.includes('refresh token not found') ||
    m.includes('refresh_token_not_found')
  )
}

import { useAuthContext } from '../contexts/AuthContext';

/**
 * Re-exports the AuthContext value.
 * Throws a descriptive error when called outside <AuthProvider>.
 */
export const useAuth = useAuthContext;

export default useAuth;

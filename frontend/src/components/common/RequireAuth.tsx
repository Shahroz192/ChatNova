import React from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated } from "../../utils/auth";

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuth, setIsAuth] = React.useState<boolean | null>(null);

    React.useEffect(() => {
        const checkAuth = async () => {
            const authenticated = await isAuthenticated();
            setIsAuth(authenticated);
        };
        checkAuth();
    }, []);

    if (isAuth === null) {
        // Loading state while checking authentication
        return <div>Loading...</div>;
    }

    if (!isAuth) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

export default RequireAuth;

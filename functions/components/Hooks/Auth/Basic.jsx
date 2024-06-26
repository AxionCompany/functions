export const AuthContext = React.createContext();

const { useState, useEffect } = React;

export const AuthProvider = (
  {
    adminRole,
    router,
    server,
    setAuthToken,
    authRoute,
    loginPath,
    applicationId,
    redirectUrl,
    onSignIn,
    publicPaths,
    children,
    ...props
  },
) => {

  authRoute = authRoute || "/auth/login";
  loginPath = loginPath || "/login";
  applicationId = applicationId || "default";
  redirectUrl = redirectUrl || "/";

  const [user, setUser] = useState({});
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const signIn = async (authCredentials) => {
    const { data } = await server.post(authRoute, authCredentials);

    const { access_token, user, token_expiration } = data;
    localStorage.setItem(`@${applicationId}:access_token`, access_token);
    localStorage.setItem(
      `@${applicationId}:token_expiration`,
      token_expiration,
    );
    localStorage.setItem(`@${applicationId}:user`, JSON.stringify(user));
    setUser(user);
    setToken(access_token);
    router.push(redirectUrl);
  };

  const signOut = async () => {
    await clearStorage();
    setToken(null);
    setUser({});
  };

  useEffect(() => {
    handleStoredInformation();
  }, []);

  useEffect(() => {
    if (token) {
      setAuthToken(token);
      if (onSignIn) onSignIn(user);
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, [token]);

  const handleStoredInformation = async () => {
    try {
      await setServerAuthorization();
      await getStoredUser();
    } catch (err) {
      console.error(err);
    }
  };

  const setServerAuthorization = async () => {
    const tokenStored = localStorage.getItem(`@${applicationId}:access_token`);
    const tokenVerification = await isTokenValid();
    if (tokenStored && tokenVerification) {
      setToken(tokenStored);
      if (router.pathname.indexOf(loginPath) > -1) {
        router?.push(redirectUrl);
      }
    } else {
      await signOut();
      if (
        publicPaths &&
        publicPaths?.indexOf(router?.asPath?.split("?")?.[0]) > -1
      ) return;
      router?.push(loginPath);
    }
  };

  const isTokenValid = async () => {
    const expirationDate = localStorage.getItem(
      `@${applicationId}:token_expiration`,
    );
    if (!expirationDate) return false;
    return new Date(expirationDate).getTime() > new Date().getTime();
  };

  const getStoredUser = async () => {
    const user = localStorage.getItem(`@${applicationId}:user`);
    if (user) {
      setUser(JSON.parse(user));
    }
  };

  const clearStorage = () => {
    localStorage.removeItem(`@${applicationId}:user`);
    localStorage.removeItem(`@${applicationId}:access_token`);
    localStorage.removeItem(`@${applicationId}:token_expiration`);
  };

  const isAdmin = () => {
    return adminRole === user.role;
  };

  return (
    <AuthContext.Provider
      value={{
        signIn,
        signOut,
        user,
        setUser,
        setToken,
        isAdmin: isAdmin(),
        server,
        isAuthenticated,
        ...props
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const WithAuth = ({ children, ...props }) => {

  return (
    <AuthContext.Consumer>
      {children}
    </AuthContext.Consumer>
  );
};

export const useAuth = () => React.useContext(AuthContext);

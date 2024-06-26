const { AlertProvider } = await importAxion("components/Hooks/Alert/main.jsx");
const { AuthProvider } = await importAxion("components/Hooks/Auth/Basic.jsx");
const { WithAuth } = await importAxion("components/Hooks/Auth/Basic.jsx");

const BaseLayout = ({ children, server, ...props }) => {
  return (
    <>
      <AlertProvider>
        <AuthProvider
          loginPath="/login/main"
          authRoute="/api/auth/login"
          applicationId="F(AX)"
          redirectUrl="/user"
          setAuthToken={(token) => {
            server.defaults.headers.common["Authorization"] = `Bearer ${token}`;
          }}
          server={server}
          adminRole=""
        >
          {AuthProvider && (
            <WithAuth>
              {(useAuth) => (
                (Array.isArray(children))
                  ? children.map((child) => (
                    React.cloneElement(child, {
                      ...props,
                      ...useAuth,
                    })
                  ))
                  : React.cloneElement(children, {
                    ...props,
                    ...useAuth,
                  })
              )}
            </WithAuth>
          )}
        </AuthProvider>
      </AlertProvider>
    </>
  );
};

export default BaseLayout;

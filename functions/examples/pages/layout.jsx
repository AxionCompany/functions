// import AlertProvider from "components/Hooks/Alert";
import { AuthProvider, WithAuth } from "axion-components/Hooks/Auth/Basic";

const BaseLayout = ({ children, ...props }) => {
  return (
    <>
      {/* <AlertProvider> */}
        <AuthProvider
          loginPath="/login/main"
          authRoute="/api/auth/login"
          applicationId="@COPILOTZ"
          redirectUrl="/user"
          setAuthToken={(token) => {
            // server.defaults.headers.common["Authorization"] = `Bearer ${token}`;
          }}
          server={fetch}
          adminRole=""
        >
          {AuthProvider &&
            WithAuth &&
            (
              <WithAuth id={new Date().getTime()}>
                {(useAuth) => {
                  return (
                    (Array.isArray(children))
                      ? children.map((child) => {
                        return React.cloneElement(child, {
                          ...props,
                          ...useAuth,
                        });
                      })
                      : React.cloneElement(children, { ...props, ...useAuth })
                  );
                }}
              </WithAuth>
            )}
        </AuthProvider>
      {/* </AlertProvider> */}
    </>
  );
};

export default BaseLayout;

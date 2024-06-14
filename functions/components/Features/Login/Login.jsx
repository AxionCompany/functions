import { Card } from "../../Base/Card/main.js";
import { LabeledInput, PasswordInput } from "../../Base/Input/main.js";
import { Row } from "../../Base/Grid/main.js";
import { Button } from "../../Base/Button/main.js";
import { Link } from "../../Base/Link/main.js";
import { Form } from "../../Base/Form/main.js";

const Login = ({
  children,
  redirectUrl,
  handleLogin,
  setIsLoading,
  loginLabel,
  loginPlaceholder,
  loginIdentifier,
  recoverPasswordUrl,
  onPasswordRecoverClick,
  rememberMe,
  ...props
} = defaultProps) => {
  return (
    <Card>
      <Form onSubmit={(e) => handleLogin(e)}>
        <LabeledInput
          label={loginLabel}
          placeholder={loginPlaceholder}
          name={loginIdentifier}
          className="w-[382px]"
        />
        <PasswordInput
          iconOn={"HiEye"}
          iconOff={"HiEyeOff"}
          label="Senha"
          placeholder="********"
          name="password"
        />
        <Row className={`${!!rememberMe ? "justify-between" : "justify-end"} mt-2`}>
          {!!rememberMe && 
            <label className="cursor-pointer">
              <input name="rememberMe" type="checkbox" className="cursor-pointer" />
              <span className="ml-2 font-light text-sm">
                Lembre-se de mim
              </span>
            </label>
          }
          {!!onPasswordRecoverClick ? (
            <label
              className={"cursor-pointer"}
              onClick={onPasswordRecoverClick}
            >
              <span className="ml-2 font-light text-sm">
                Esqueceu a senha?
              </span>
            </label>
          ) : (
            <Link href={`${recoverPasswordUrl || "/recuperar-senha"}`}>
              <span className={"font-light text-sm cursor-pointer align-bottom"}>
                Esqueceu a senha?
              </span>
            </Link>
          )}
        </Row>
        <Button className="mt-10 w-[382px]" type="submit">
          Acessar o sistema
        </Button>
      </Form>
    </Card>
  );
};

const defaultProps = {
  handleLogin: (e) => window.alert(JSON.stringify(e)),
  loginLabel: "E-mail",
  loginPlaceholder: "nome@email.com",
  loginIdentifier: "email",
};

export default Login;

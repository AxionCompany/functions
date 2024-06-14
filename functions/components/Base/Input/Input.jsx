// import InputMask from 'npm:react-input-mask';
import { IMaskInput } from "npm:react-imask";

const Input = ({ className, ...props }) => {
  const baseClass = `input input-bordered w-full ${className}`;
  return (
    <IMaskInput
      className={baseClass}
      {...props}
    />
  );
};

export default Input;

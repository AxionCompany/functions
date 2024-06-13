import { useFormContext } from "npm:react-hook-form";

const Input = ({ name, className, ...props }) => {
    const formContext = useFormContext()
    const { register } = formContext || {};
    const baseClass = `input input-bordered w-full ${className}`
    return (
        register ?
            <input
                className={baseClass}
                {...register(name)}
                {...props}
            />
            :
            <input
                className={baseClass}
                {...props}
            />

    )
};

export default Input;

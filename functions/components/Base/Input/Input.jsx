import InputMask from 'npm:react-input-mask';

const Input = ({ className, ...props })=> {
    const baseClass = `input input-bordered w-full ${className}`;
    return (
        <InputMask
            className={baseClass}
            {...props}
        />
    )
};


export default Input;

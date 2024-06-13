const TextAreaInput = ({ requiredLabel, label, className, inputClassName, ...props }) => {
    return (
        <div className={`form-control w-full ${className}`}>
            <label className="label">
                <span className="label-text">{label}</span>
                {requiredLabel && <span className="text-zinc-400 text-xs">{requiredLabel}</span>}
            </label>
            <textarea className={`textarea textarea-bordered ${inputClassName}`} {...props}></textarea>
        </div >
    )
};

export default TextAreaInput;

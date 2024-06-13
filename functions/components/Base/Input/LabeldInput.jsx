import Input from './Input.jsx';

const LabeledInput = ({ requiredLabel, label, className, tooltip, ...props }) => {
    return (
        <div className={`form-control w-full  ${tooltip ? 'tooltip' : ''} ${className}`}  data-tip={tooltip ? tooltip : null}>
            <label className="label">
                <span className="label-text">{label}</span>
                {requiredLabel && <span className="text-zinc-400 text-xs">{requiredLabel}</span>}
            </label>
            <Input {...props} />
        </div>
    )
};

export default LabeledInput;

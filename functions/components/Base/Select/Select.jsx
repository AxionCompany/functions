const Select = ({
  label,
  placeholder,
  requiredLabel,
  defaultSelected,
  options,
  onChange,
  attr,
  className
}) => {
  const [selected, setSelected] = React.useState(defaultSelected)

  const handleSelect = (e) => {
    const _selected = e?.target?.value;
    let selectedObj;
    if (_selected) {
      selectedObj = options.find((opt) => opt[attr] === _selected);
    }
    setSelected(selectedObj?.[attr] || "");
    return onChange(selectedObj?.[attr] || "");
  };

  React.useEffect(() => {
    if (defaultSelected)setSelected(defaultSelected)
  }, [defaultSelected])

  return (
    <div className={`form-control align-top w-full ${className || 'max-w-sm'}`}>
      <label className="label">
        <span className="label-text ">
          {label}
          <span className="ml-4 text-zinc-400 text-xs">{requiredLabel}</span>
        </span>
      </label>
      <select
        onChange={handleSelect}
        className="select select-bordered"
        value={selected}
      >
        <option className="disabled">{placeholder}</option>
        {options &&
          options.map((opt, index) => {
            return (
              <option key={index} value={opt?.[attr]}>
                {opt.name}
              </option>
            )
          })
        }
      </select>
    </div>
  );
};

export default Select;
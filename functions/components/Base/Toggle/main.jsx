export default ({ label, colorOn, colorOff, onChange, className }) => {
  colorOn = colorOn || "bg-success";
  colorOff = colorOff || "bg-neutral";
  const [checked, setChecked] = React.useState(false);
  const handleChange = (e) => {
    setChecked(e.target.checked);
    onChange(e);
  };
  return (
    <label className="cursor-pointer label">
      <span className="label-text m-2">{label}</span>
      <input
        type="checkbox"
        className={`toggle ${checked ? colorOn : colorOff} ${className}`}
        checked={checked}
        onChange={handleChange}
      />
    </label>
  );
};

import DateInput from "./DateInput.jsx";
import { Col } from "../Grid/main.js";

const LabeledDateInput = ({
  label,
  requiredLabel,
  minDate, //YYYY-MM-DD
  maxDate, //YYYY-MM-DD
  className,
  ...props
}) => {
  return (
    <Col>
      <label className="label">
        <span className="label-text">{label}</span>
        {requiredLabel && (
          <span className="text-zinc-400 text-xs">{requiredLabel}</span>
        )}
      </label>
      <DateInput
        minDate={minDate}
        maxDate={maxDate}
        className={className}
        {...props}
      />
    </Col>
  );
};

export default LabeledDateInput;

import { Button } from '../Button/main.js';
import { Row } from '../Grid/main.js';

const FormActions = ({
  submitButton,
  submitStyle,
  cancelButton,
  cancelAction,
  cancelStyle,
  loading
}) => (
  <Row className="my-6 justify-between">
    {cancelButton && (
      <Button
        type="button"
        onClick={cancelAction}
        className={`btn-outline btn-primary ${cancelStyle}`}
        disabled={loading}
      >
        <span className="text-sm font-medium">{cancelButton}</span>
      </Button>
    )}
    {submitButton && (
      <Button
        type="submit"
        className={`${submitStyle} ${loading && 'loading'}`}
        disabled={loading}
      >
        <span className="text-sm font-medium">{submitButton}</span>
      </Button>
    )}
  </Row>
);

export default FormActions;

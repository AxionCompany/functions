const Status = ({ status, className }) => (
  <div
    className={`w-5 h-5 rounded-full flex justify-center items-center bg-${status} ${className}`}
  >
  </div>
);

export default Status;

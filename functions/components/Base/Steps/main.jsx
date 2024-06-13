export default ({ steps, currentStep, setCurrentStep }) => {
  return (
    <ul className="steps w-full">
      {steps.map((step, index) => (
        <li 
          onClick={() => setCurrentStep(index + 1)}
          key={index}
          className={`step cursor-pointer ${index + 1 <= currentStep ? "step-primary" : ""}`}
        >
          {step}
        </li>
      ))}
    </ul>
  );
};

import Steps from "../../Base/Steps/main.jsx";
import Animate from "../../Base/Animate/main.jsx";
import Mockup from "../../Base/Mockup/main.jsx";

export default ({ title, subtitle, process, postscript }) => {
  const [currentStep, setCurrentStep] = React.useState(1);
  return (
    <section
      id="process-steps"
      className="flex flex-row justify-center items-center space-y-6 py-8 md:py-12 lg:py-24"
    >
      <div className="flex flex-col justify-center items-center text-center mx-4">
        <div className="mx-auto max-w-[58rem] flex-col items-center space-y-4 text-center">
          <h2 className="font-extrabold text-3xl leading-[1.1] sm:text-3xl md:text-6xl">
            {title}
          </h2>
          <p className=" leading-normal text-base-content sm:text-lg sm:leading-7 balance-text">
            {subtitle}
          </p>
        </div>
        <div className="flex flex-row w-full my-12">
          <Steps
            steps={Object.keys(process)}
            setCurrentStep={setCurrentStep}
            currentStep={currentStep}
          />
        </div>
        <div className="flex mx-auto justify-start md:max-w-[64rem] ">
          {Object.keys(process).map((step, index) => (
            (
              <Animate
                key={index}
              >
                <div
                  className={`flex flex-col md:flex-row w-full items-start justify-between ${
                    (currentStep === index + 1) ? "" : "hidden"
                  }`}
                >
                  <Mockup
                    type="browser"
                    outerClass={"border-gradient opacity-70 bg-base-100 mr-12 hidden md:block max-w-[400px]"}
                    url="https://copilotz.com"
                  >
                    {process[step].component}
                  </Mockup>
                  <div className="flex flex-col items-start justify-start max-w-[600px] mt-8">
                    <h3 className="font-extrabold text-2xl text-start leading-[1.1] sm:text-4xl md:text-5xl text-gradient my-4">
                      {process[step].title}
                    </h3>
                    <p className="leading-normal text-start text-base-content sm:text-lg sm:leading-7 balance-text">
                      {process[step].content}
                    </p>
                  </div>
                </div>
              </Animate>
            )
          ))}
        </div>

        <div className="mx-auto text-center md:max-w-[58rem]">
          <p className="leading-normal text-base-content sm:text-lg sm:leading-7 balance-text">
            {postscript}
          </p>
        </div>
      </div>
    </section>
  );
};

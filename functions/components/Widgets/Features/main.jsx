import Card from "../../Base/Card/main.jsx";
import Animate from "../../Base/Animate/main.jsx";

export default ({ title, subtitle, features, postscript }) => {
  return (
    <section
      id="features"
      className="flex flex-row justify-center items-center space-y-6 py-8 md:py-12 lg:py-24"
    >
      <div className="flex flex-col justify-center items-center gap-5 text-center mx-4">
        <div className="mx-auto max-w-[58rem] flex-col items-center space-y-4 text-center">
          <h2 className="font-extrabold text-3xl leading-[1.1] sm:text-3xl md:text-6xl">
            {title}
          </h2>
          <p className=" leading-normal text-base-content sm:text-lg sm:leading-7 balance-text">
            {subtitle}
          </p>
        </div>
        <div className="flex mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-2">
          {features.map((feature, index) => (
            <Animate
              key={index}
            >
              <Card
                key={index}
                title={feature.title}
                content={feature.content}
                component={feature.icon}
                outerClassName={`border-gradient md:min-w-[400px] `}
              />
            </Animate>
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

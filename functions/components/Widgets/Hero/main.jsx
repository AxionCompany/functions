export default ({ title, subtitle, ctas }) => {
  return (
    <section id="hero" className="flex space-y-6 pb-12 pt-16 lg:pt-28 lg:pb-24 justify-center items-center">
      <div className="container flex flex-col max-w-4xl justify-center items-center gap-5 text-center mx-4">
        <h1 className="font-extrabold text-4xl font-bold sm:text-5xl md:text-6xl lg:text-7xl !leading-[1.1] text-balance">
            {title}
        </h1>

        <p className="max-w-[42rem] leading-normal sm:text-xl sm:leading-8 text-balance">
            {subtitle}
        </p>

        <div className="flex justify-center space-x-2 md:space-x-4">
          {ctas.map((cta, index) => (
            <a
              key={index}
              className={`btn ${!index ? "btn-primary" : "btn-secondary"}`}
              href={cta.href}
              onClick={cta.onClick}
            >
              {cta.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};


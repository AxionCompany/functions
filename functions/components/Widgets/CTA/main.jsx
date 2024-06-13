export default ({ title, subtitle, cta, id }) => {
  return (
    <section
      id={`cta-${id}`}
      className="flex flex-row justify-center items-center py-8 "
    >
      <div className="flex flex-col max-w-3xl justify-center items-center text-center m-4 md:py-12 lg:py-28 md:min-w-[1000px] rounded-2xl background-gradient">
        <div className="flex mx-auto max-w-4xl flex-col items-center justify-center gap-4 text-center py-4">
          <h2 className="font-extrabold text-3xl leading-[1.1] sm:text-3xl md:text-5xl">
            {title}
          </h2>
          <p className="leading-normal text-base-content sm:text-lg sm:leading-7">
            {subtitle}
          </p>
        </div>
        {cta && (
          <a
            href={cta.href}
            onClick={cta.onClick}
            className="btn btn-primary"
          >
            {cta.label}
          </a>
        )}
      </div>
    </section>
  );
};

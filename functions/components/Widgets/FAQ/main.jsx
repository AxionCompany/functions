import Accordion from "../../Base/Accordion/main.jsx";

export default ({ title, subtitle, qna }) => {
  const data = qna.map((faq) => ({
    title: faq.question,
    content: faq.answer,
    id: faq.id,
  }));
  return (
    <section
      id="faq"
      className="flex flex-row justify-center items-center bg-base-200 py-8 md:py-12 lg:py-28 py-8 md:py-12 lg:py-28"
    >
      <div className="container flex flex-col max-w-3xl justify-center items-center text-center mx-4">
        <div className="space-y-6 text-center mb-14">
          <h1 className="font-extrabold text-4xl text-center">
            {title}
          </h1>
          <p className="text-base-content text-md">
            {subtitle}
          </p>
        </div>
        <Accordion data={data} />
      </div>
    </section>
  );
};

import Menu from "../../Base/Menu/main.jsx";

const headerClasses = ["header-hidden", "header-visible"];

export default ({ logo, menu }) => {
  const [headerClass, setHeaderClass] = React.useState("header-hidden");

  React.useEffect(() => {
    const handleScroll = () => {
      // Toggle the class based on scroll position
      const show = window.scrollY > 100;
      setHeaderClass(show ? "header-visible" : "header-hidden");
    };

    // Listen for scroll events
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <>
      <div
        className={`flex flex-row justify-between align-center backdrop fixed w-full z-10 px-4 md:px-24 ${headerClass}`}
      >
        <a href="#home" className="flex flex-col justify-center align-center">
          {logo}
        </a>
        <Menu
          items={[
            { label: "Home", href: "#home" },
            { label: "Our Copilotz", href: "#home" },
            { label: "Features", href: "#features" },
          ]}
        />
        <div className="md:min-w-[100px]"></div>
      </div>
      <div
        className={`flex flex-row justify-center align-center pt-8 w-full z-10 ${
          headerClass === "header-visible" ? "hidden" : ""
        } `}
      >
        <a href="#home" className="flex flex-col justify-center align-center">
          {logo}
        </a>
      </div>
    </>
  );
};

export default (props) => {
  return (
    <footer className="flex p-10 items-center justify-center bg-neutral text-neutral-content">
      <div className="footer max-w-4xl">
        <aside>
          {props.logo}
          <p>
            {props.slogan}
          </p>
        </aside>
        {Object.keys(props.content).map((key, index) => (
          <nav key={index}>
            <h6 className="footer-title">{key}</h6>
            {props.content[key].map((item, index) => (
              <a key={index} className="link link-hover" href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        ))}
      </div>
    </footer>
  );
};

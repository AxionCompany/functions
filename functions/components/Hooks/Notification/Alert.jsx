import { Alert } from "../../Base/Alert/main.js";

const { useState, useEffect } = React;

const AlertContext = React.createContext({});

export const AlertProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState("error");
  const [message, setMessage] = useState("");
  const [delay, setDelay] = useState(4000);

  const timeout = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  const handleCloseModal = async () => {
    await timeout(4000);
    setIsOpen(false);
  };

  useEffect(() => {
    if (isOpen) {
      handleCloseModal();
    }
  }, [isOpen]);

  const showAlert = (
    { message: messageToShow, type: typeToShow, delay: delayToShow },
  ) => {
    setMessage(messageToShow);
    if (typeToShow) {
      setType(typeToShow);
    }
    if (delayToShow) {
      setDelay(delayToShow);
    }
    setIsOpen(true);
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {isOpen && <Alert type={type} message={message} />}
      {children}
    </AlertContext.Provider>
  );
};

export const useAlert = () => React.useContext(AlertContext);

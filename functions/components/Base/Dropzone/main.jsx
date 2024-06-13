
import { useDropzone } from 'npm:react-dropzone'
import Icon from '../Icon/main.jsx'

function Dropzone({ classes, title, textMessage, textColor, onDrop, file, setFile, isLoadingFile }) {
  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  return(
    <>
      <label className="label">
        <span className="label-text">{title || "Anexar arquivo"}</span>
      </label>
      <div {...getRootProps()} className={classes}>
        {file ? (
          <div className="flex">
            {isLoadingFile ? (
              <span className={`text-${textColor}`}>{"Carregando ..."}</span>
            ) : (
              <>
                <span className={`text-${textColor}`}>{file.name}</span>
                <Icon 
                  size={"24px"}
                  iconName={"HiTrash"}
                  classes={"ml-2"}
                  onClick={() => setFile(null)}
                />
              </>
            )}
          </div>
        ) : (
          <>
            <input {...getInputProps()} />
            <Icon 
              size={"32px"}
              iconName={"HiDocumentAdd"}
              color={`${textColor}`}
            />
            <span>{textMessage}</span>
          </>
        )}
      </div>
    </>
  )
}

export default Dropzone;
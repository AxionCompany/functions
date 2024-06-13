const TableData = ({ children, className, onClick, rowIndex }) => (
    <td className={className} style={{ padding: "0px" }}>
        <label 
            htmlFor={`row-${rowIndex}`}
            className={`block !p-4 !w-full hover ${onClick ? 'cursor-pointer' : ''}`}
            style={{ padding: "16px" }}
            onClick={()=>onClick()}
        >
            {children}
        </label>
    </td>
);

export default TableData;
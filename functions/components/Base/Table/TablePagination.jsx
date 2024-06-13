import { Button } from "../Button/main.js";

const TablePagination = ({ currentPage, pages, onChangePage }) => (
  <div className="btn-group justify-end my-4">
    {currentPage > 1
      ? (
        <Button
          onClick={() => onChangePage(1)}
          className="btn-outline"
          wide={false}
        >
          1
        </Button>
      )
      : null}
    {currentPage > 3
      ? (
        <Button
          className="btn-disabled"
          wide={false}
        >
          ...
        </Button>
      )
      : null}
    {currentPage > 2
      ? (
        <Button
          onClick={() => onChangePage(currentPage - 1)}
          className="btn-outline"
          wide={false}
        >
          Ant.
        </Button>
      )
      : null}
    <Button
      className="btn-disabled"
      wide={false}
    >
      {currentPage}
    </Button>
    {currentPage + 1 < pages
      ? (
        <Button
          onClick={() => onChangePage(currentPage + 1)}
          className="btn-outline"
          wide={false}
        >
          Prox.
        </Button>
      )
      : null}
    {currentPage + 2 < pages
      ? (
        <Button
          className="btn-disabled"
          wide={false}
        >
          ...
        </Button>
      )
      : null}
    {pages > 1 && currentPage !== pages
      ? (
        <Button
          onClick={() => onChangePage(pages)}
          className="btn-outline"
          wide={false}
        >
          {pages}
        </Button>
      )
      : null}
  </div>
);

export default TablePagination;

import { useState } from 'react';
import { Link } from '../routing/navigation';
import { dataSource } from '../data/dataSource';
import { useAsyncData } from '../hooks/useAsyncData';
import { Card, DocumentLink, ErrorState, Field, LoadingState, PageHeader } from '../components/ui';
import { Pagination } from '../components/domain/Shared';
import { formatDate } from '../utils/format';

export function PracticeClosuresPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsyncData(() => dataSource.listPracticeClosures({ search, page, pageSize: 25 }), [search, page]);
  return <><PageHeader title="Cierre de práctica" description="Alumnos que entregaron su estudio jurídico. Sus fichas, procesos e historial se conservan para consulta." /><Card><Field label="Buscar alumno o carné"><input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></Field>
    {loading ? <LoadingState label="Cargando cierres de práctica" /> : error ? <ErrorState error={error} retry={reload} /> : data?.items.length ? <><div className="table-scroll"><table><thead><tr><th>Alumno</th><th>Carné</th><th>Fecha de entrega</th><th>Estudio jurídico</th></tr></thead><tbody>{data.items.map(item => <tr key={item.studentId}><td><Link to={`/personas/alumnos/${item.studentId}`}>{item.studentName}</Link></td><td>{item.studentCardNumber}</td><td>{formatDate(item.deliveryDate)}</td><td><DocumentLink documentId={item.finalDocumentId} label="Ver documento final" /></td></tr>)}</tbody></table></div><Pagination page={page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={setPage} /></> : <p className="muted">Todavía no hay alumnos con práctica cerrada por entrega de estudio jurídico.</p>}
  </Card></>;
}

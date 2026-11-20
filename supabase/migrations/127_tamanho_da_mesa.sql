-- Tamanho da mesa do café (pequeno, médio, grande). Redonda e quadrada atuais = pequeno; retangular (Mesa 7) = grande.
-- As dimensões já gravadas (width/height) não mudam; passam a ser recalculadas quando o tamanho é alterado.
alter table breakfast_tables add column if not exists size text not null default 'pequeno';
alter table breakfast_tables drop constraint if exists breakfast_tables_size_check;
alter table breakfast_tables add constraint breakfast_tables_size_check check (size in ('pequeno', 'medio', 'grande'));
update breakfast_tables set size = 'grande' where shape = 'rect';

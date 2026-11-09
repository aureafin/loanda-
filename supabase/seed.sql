insert into categories(slug,name,sort_order) values
('livros','Livros Digitais',1),('cursos','Cursos',2),('documentos','Documentos Profissionais',3),
('planos-de-negocio','Planos de Negócios',4),('planilhas','Planilhas e Ferramentas',5),('produtos-fisicos','Produtos Físicos',6)
on conflict (slug) do nothing;

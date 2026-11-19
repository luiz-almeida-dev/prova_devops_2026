# API de produtos

## Execução local

Na raiz do projeto, gere o arquivo local de configuração uma vez. As senhas são geradas aleatoriamente e gravadas no arquivo ignorado pelo Git.

```bash
(umask 077 && set -o noclobber && node -e '
  const { readFileSync } = require("node:fs");
  const { randomBytes } = require("node:crypto");
  const config = readFileSync("api/.env.example", "utf8");
  process.stdout.write(config.replace(/^(MYSQL_(?:ROOT_)?PASSWORD)=$/gm,
    (_, key) => key + "=" + randomBytes(24).toString("hex")));
' > api/.env)
docker compose -f api/docker-compose.yml config --quiet
docker compose -f api/docker-compose.yml up -d --build
docker compose -f api/docker-compose.yml ps
```

| Variável | Uso |
|---|---|
| `MYSQL_DATABASE` | Nome do banco criado na inicialização |
| `MYSQL_USER` e `MYSQL_PASSWORD` | Usuário e senha usados pela API |
| `MYSQL_ROOT_PASSWORD` | Senha administrativa do MySQL |
| `WEB_ORIGIN` | Origem exata do frontend, com esquema e porta se aplicável, sem barra final |
| `API_BIND_IP` | IP do host para publicar a porta 3000. O padrão local é `127.0.0.1` |

A API acessa o serviço `mysql` pela rede padrão do Compose. O MySQL inicializa a tabela a partir de `init.sql` quando o volume `mysql-data` está vazio. A verificação de saúde consulta a tabela com o usuário da aplicação via TCP. Preserve o volume e as credenciais usadas na primeira inicialização ao reiniciar os serviços.

## Contrato HTTP

- `POST /produto` recebe JSON com `name`, `category`, `price` e `quantity`. Retorna `201` com o produto cadastrado.
- `GET /produtos` retorna `200` com uma lista JSON de produtos em ordem de cadastro.
- Nome e categoria aceitam de 1 a 255 caracteres após a remoção de espaços nas extremidades. O preço é um número não negativo com até duas casas decimais e a quantidade é um inteiro entre 0 e 4294967295.
- Requisições inválidas retornam um objeto JSON com `error`. Dados de produto inválidos retornam `400`.

A API local fica em `http://127.0.0.1:3000`. Para a integração posterior, configure a origem da VM1 em `WEB_ORIGIN` e o IP de publicação da VM2 em `API_BIND_IP`.

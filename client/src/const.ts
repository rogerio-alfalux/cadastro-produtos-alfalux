export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// O Cadastro usa autenticação interna por e-mail e senha. Este helper é
// preservado para componentes legados, mas nunca encaminha usuários à
// plataforma externa, que não concede acesso operacional por perfil.
export const getLoginUrl = () => "/login";

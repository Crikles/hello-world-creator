/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu email para ativar sua conta Magnus Frete</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>MAGNUS FRETE</Text>
        </Section>
        <Heading style={h1}>Confirme seu email</Heading>
        <Text style={text}>
          Olá! Recebemos o cadastro de <strong>{recipient}</strong> na Magnus Frete.
        </Text>
        <Text style={text}>
          Para ativar sua conta e começar a gerenciar seus envios, clique no botão abaixo:
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button style={button} href={confirmationUrl}>
            Ativar minha conta
          </Button>
        </Section>
        <Text style={fallback}>
          O botão não funciona? Copie e cole este link no seu navegador:
        </Text>
        <Link href={confirmationUrl} style={link}>
          {confirmationUrl}
        </Link>
        <Text style={footer}>
          Se você não criou esta conta, ignore este email com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const header = { borderBottom: '2px solid #d4a017', paddingBottom: '16px', marginBottom: '24px' }
const brand = {
  fontSize: '18px',
  fontWeight: 'bold' as const,
  letterSpacing: '2px',
  color: '#0a0a0a',
  margin: 0,
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#0a0a0a',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: '#3f3f46',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const button = {
  backgroundColor: '#d4a017',
  color: '#0a0a0a',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '14px 32px',
  textDecoration: 'none',
  display: 'inline-block',
}
const fallback = { fontSize: '12px', color: '#71717a', margin: '24px 0 8px' }
const link = { fontSize: '12px', color: '#d4a017', wordBreak: 'break-all' as const }
const footer = { fontSize: '12px', color: '#a1a1aa', margin: '32px 0 0', borderTop: '1px solid #e4e4e7', paddingTop: '16px' }

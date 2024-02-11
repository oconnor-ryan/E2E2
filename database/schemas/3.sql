--
-- PostgreSQL database dump
--

-- Dumped from database version 16.1
-- Dumped by pg_dump version 16.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'SQL_ASCII';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id character varying(30) NOT NULL,
    identity_key_base64 character varying NOT NULL,
    exchange_key_base64 character varying NOT NULL,
    exchange_key_signature_base64 character varying NOT NULL,
    exchange_prekey_base64 character varying NOT NULL,
    exchange_prekey_signature_base64 character varying NOT NULL,
    CONSTRAINT account_id_check CHECK (((id)::text <> ''::text))
);


--
-- Name: chat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat (
    id integer NOT NULL,
    name_base64_enc character varying(50) DEFAULT ''::character varying
);


--
-- Name: chat_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_id_seq OWNED BY public.chat.id;


--
-- Name: chat_member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_member (
    acct_id character varying(30) NOT NULL,
    nick_name character varying(30) NOT NULL,
    chat_id integer NOT NULL,
    is_admin boolean DEFAULT false,
    can_invite boolean DEFAULT false
);


--
-- Name: message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message (
    id bigint NOT NULL,
    data_enc_base64 character varying NOT NULL,
    sender_id character varying(30) NOT NULL,
    chat_id integer NOT NULL
);


--
-- Name: message_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.message_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: message_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.message_id_seq OWNED BY public.message.id;


--
-- Name: pending_chat_invite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_chat_invite (
    invitor_acct_id character varying(30) NOT NULL,
    invited_acct_id character varying(30) NOT NULL,
    chat_id integer NOT NULL,
    CONSTRAINT pending_chat_invite_check CHECK (((invitor_acct_id)::text <> (invited_acct_id)::text))
);


--
-- Name: pending_key_exchange; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_key_exchange (
    sender_id character varying(30) NOT NULL,
    receiver_id character varying(30) NOT NULL,
    chat_id integer NOT NULL,
    ephemeral_key_base64 character varying NOT NULL,
    sender_key_enc_base64 character varying NOT NULL,
    salt_base64 character varying NOT NULL,
    message_id_start bigint NOT NULL,
    marked_for_deletion boolean DEFAULT false NOT NULL,
    CONSTRAINT key_exchange_check CHECK (((sender_id)::text <> (receiver_id)::text))
);


--
-- Name: chat id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat ALTER COLUMN id SET DEFAULT nextval('public.chat_id_seq'::regclass);


--
-- Name: message id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message ALTER COLUMN id SET DEFAULT nextval('public.message_id_seq'::regclass);


--
-- Name: account account_exchange_key_base64_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_exchange_key_base64_key UNIQUE (exchange_key_base64);


--
-- Name: account account_identity_key_base64_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_identity_key_base64_key UNIQUE (identity_key_base64);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: account account_signature_base64_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_signature_base64_key UNIQUE (exchange_key_signature_base64);


--
-- Name: chat_member chat_member_nick_name_chat_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_member
    ADD CONSTRAINT chat_member_nick_name_chat_id_key UNIQUE (nick_name, chat_id);


--
-- Name: chat_member chat_member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_member
    ADD CONSTRAINT chat_member_pkey PRIMARY KEY (acct_id, chat_id);


--
-- Name: chat chat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat
    ADD CONSTRAINT chat_pkey PRIMARY KEY (id);


--
-- Name: pending_key_exchange key_exchange_chat_id_message_id_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_key_exchange
    ADD CONSTRAINT key_exchange_chat_id_message_id_start_key UNIQUE (chat_id, message_id_start);


--
-- Name: message message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_pkey PRIMARY KEY (id);


--
-- Name: pending_chat_invite pending_chat_invite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_chat_invite
    ADD CONSTRAINT pending_chat_invite_pkey PRIMARY KEY (invited_acct_id, chat_id);


--
-- Name: chat_member chat_member_acct_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_member
    ADD CONSTRAINT chat_member_acct_id_fkey FOREIGN KEY (acct_id) REFERENCES public.account(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: chat_member chat_member_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_member
    ADD CONSTRAINT chat_member_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chat(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: pending_key_exchange key_exchange_message_id_start_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_key_exchange
    ADD CONSTRAINT key_exchange_message_id_start_fkey FOREIGN KEY (message_id_start) REFERENCES public.message(id) ON UPDATE CASCADE;


--
-- Name: pending_key_exchange key_exchange_receiver_id_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_key_exchange
    ADD CONSTRAINT key_exchange_receiver_id_chat_id_fkey FOREIGN KEY (receiver_id, chat_id) REFERENCES public.chat_member(acct_id, chat_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: pending_key_exchange key_exchange_sender_id_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_key_exchange
    ADD CONSTRAINT key_exchange_sender_id_chat_id_fkey FOREIGN KEY (sender_id, chat_id) REFERENCES public.chat_member(acct_id, chat_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: message message_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chat(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: message message_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.account(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: pending_chat_invite pending_chat_invite_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_chat_invite
    ADD CONSTRAINT pending_chat_invite_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chat(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: pending_chat_invite pending_chat_invite_invited_acct_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_chat_invite
    ADD CONSTRAINT pending_chat_invite_invited_acct_id_fkey FOREIGN KEY (invited_acct_id) REFERENCES public.account(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: pending_chat_invite pending_chat_invite_invitor_acct_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_chat_invite
    ADD CONSTRAINT pending_chat_invite_invitor_acct_id_fkey FOREIGN KEY (invitor_acct_id) REFERENCES public.account(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


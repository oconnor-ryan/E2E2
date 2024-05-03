--
-- PostgreSQL database dump
--

-- Dumped from database version 16.2
-- Dumped by pg_dump version 16.2

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
    identity_key_public character varying NOT NULL,
    username character varying(30) NOT NULL,
    exchange_id_key_public character varying NOT NULL,
    exchange_prekey_public character varying NOT NULL,
    exchange_id_key_signature character varying NOT NULL,
    exchange_prekey_signature character varying NOT NULL,
    mailbox_id character varying NOT NULL,
    password_hash character varying NOT NULL,
    password_salt character varying NOT NULL
);


--
-- Name: file; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file (
    file_uuid uuid NOT NULL,
    date_send date DEFAULT CURRENT_DATE NOT NULL,
    access_token character varying NOT NULL
);


--
-- Name: key_exchange_request_incoming; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.key_exchange_request_incoming (
    encrypted_payload character varying NOT NULL,
    date_sent date DEFAULT CURRENT_DATE NOT NULL,
    sender_server character varying DEFAULT ''::character varying NOT NULL,
    receiver_username character varying NOT NULL,
    sender_username character varying NOT NULL,
    id uuid NOT NULL,
    insert_id bigint NOT NULL,
    ephemeral_key_public character varying NOT NULL,
    ephemeral_salt character varying NOT NULL
);


--
-- Name: key_exchange_request_incoming_insert_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.key_exchange_request_incoming_insert_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: key_exchange_request_incoming_insert_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.key_exchange_request_incoming_insert_id_seq OWNED BY public.key_exchange_request_incoming.insert_id;


--
-- Name: key_exchange_request_outgoing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.key_exchange_request_outgoing (
    receiver_server character varying NOT NULL,
    encrypted_payload character varying NOT NULL,
    date_sent date DEFAULT CURRENT_DATE NOT NULL,
    sender_username character varying NOT NULL,
    receiver_username character varying NOT NULL,
    id uuid NOT NULL,
    insert_id bigint NOT NULL,
    ephemeral_key_public character varying NOT NULL,
    ephemeral_salt character varying NOT NULL
);


--
-- Name: key_exchange_request_outgoing_insert_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.key_exchange_request_outgoing_insert_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: key_exchange_request_outgoing_insert_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.key_exchange_request_outgoing_insert_id_seq OWNED BY public.key_exchange_request_outgoing.insert_id;


--
-- Name: message_incoming; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_incoming (
    id uuid NOT NULL,
    insert_id bigint NOT NULL,
    receiver_mailbox_id character varying NOT NULL,
    encrypted_payload character varying NOT NULL,
    date_sent date DEFAULT CURRENT_DATE NOT NULL,
    sender_identity_key_public character varying NOT NULL
);


--
-- Name: message_incoming_insert_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.message_incoming_insert_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: message_incoming_insert_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.message_incoming_insert_id_seq OWNED BY public.message_incoming.insert_id;


--
-- Name: message_outgoing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_outgoing (
    id uuid NOT NULL,
    insert_id bigint NOT NULL,
    receiver_mailbox_id character varying NOT NULL,
    receiver_server character varying NOT NULL,
    encrypted_payload character varying NOT NULL,
    date_sent date DEFAULT CURRENT_DATE NOT NULL,
    sender_identity_key_public character varying NOT NULL
);


--
-- Name: message_outgoing_insert_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.message_outgoing_insert_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: message_outgoing_insert_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.message_outgoing_insert_id_seq OWNED BY public.message_outgoing.insert_id;


--
-- Name: one_time_prekey; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.one_time_prekey (
    account_id_key character varying,
    prekey_public character varying NOT NULL
);


--
-- Name: key_exchange_request_incoming insert_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_exchange_request_incoming ALTER COLUMN insert_id SET DEFAULT nextval('public.key_exchange_request_incoming_insert_id_seq'::regclass);


--
-- Name: key_exchange_request_outgoing insert_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_exchange_request_outgoing ALTER COLUMN insert_id SET DEFAULT nextval('public.key_exchange_request_outgoing_insert_id_seq'::regclass);


--
-- Name: message_incoming insert_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_incoming ALTER COLUMN insert_id SET DEFAULT nextval('public.message_incoming_insert_id_seq'::regclass);


--
-- Name: message_outgoing insert_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_outgoing ALTER COLUMN insert_id SET DEFAULT nextval('public.message_outgoing_insert_id_seq'::regclass);


--
-- Name: account account_exchange_id_key_public_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_exchange_id_key_public_key UNIQUE (exchange_id_key_public);


--
-- Name: account account_mailbox_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_mailbox_id_key UNIQUE (mailbox_id);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (identity_key_public);


--
-- Name: account account_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_username_key UNIQUE (username);


--
-- Name: file file_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file
    ADD CONSTRAINT file_pkey PRIMARY KEY (file_uuid);


--
-- Name: key_exchange_request_incoming message_invite_incoming_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_exchange_request_incoming
    ADD CONSTRAINT message_invite_incoming_id_key UNIQUE (id);


--
-- Name: key_exchange_request_incoming message_invite_incoming_insert_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_exchange_request_incoming
    ADD CONSTRAINT message_invite_incoming_insert_id_key UNIQUE (insert_id);


--
-- Name: key_exchange_request_incoming message_invite_incoming_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_exchange_request_incoming
    ADD CONSTRAINT message_invite_incoming_pkey PRIMARY KEY (receiver_username, sender_username, sender_server);


--
-- Name: key_exchange_request_outgoing message_invite_outgoing_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_exchange_request_outgoing
    ADD CONSTRAINT message_invite_outgoing_id_key UNIQUE (id);


--
-- Name: key_exchange_request_outgoing message_invite_outgoing_insert_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_exchange_request_outgoing
    ADD CONSTRAINT message_invite_outgoing_insert_id_key UNIQUE (insert_id);


--
-- Name: key_exchange_request_outgoing message_invite_outgoing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_exchange_request_outgoing
    ADD CONSTRAINT message_invite_outgoing_pkey PRIMARY KEY (receiver_username, sender_username, receiver_server);


--
-- Name: message_incoming message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_incoming
    ADD CONSTRAINT message_pkey PRIMARY KEY (id);


--
-- Name: message_outgoing remote_message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_outgoing
    ADD CONSTRAINT remote_message_pkey PRIMARY KEY (id);


--
-- Name: key_exchange_request_incoming message_invite_incoming_receiver_username_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_exchange_request_incoming
    ADD CONSTRAINT message_invite_incoming_receiver_username_fkey FOREIGN KEY (receiver_username) REFERENCES public.account(username) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: key_exchange_request_outgoing message_invite_outgoing_sender_username_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_exchange_request_outgoing
    ADD CONSTRAINT message_invite_outgoing_sender_username_fkey FOREIGN KEY (sender_username) REFERENCES public.account(username) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: message_outgoing message_outgoing_sender_identity_key_public_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_outgoing
    ADD CONSTRAINT message_outgoing_sender_identity_key_public_fkey FOREIGN KEY (sender_identity_key_public) REFERENCES public.account(identity_key_public) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: message_incoming message_receiver_mailbox_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_incoming
    ADD CONSTRAINT message_receiver_mailbox_id_fkey FOREIGN KEY (receiver_mailbox_id) REFERENCES public.account(mailbox_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: one_time_prekey one_time_prekey_account_id_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.one_time_prekey
    ADD CONSTRAINT one_time_prekey_account_id_key_fkey FOREIGN KEY (account_id_key) REFERENCES public.account(identity_key_public) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


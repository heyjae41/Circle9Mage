--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Debian 15.13-1.pgdg120+1)
-- Dumped by pg_dump version 15.13 (Debian 15.13-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: circlepay_connection_test; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.circlepay_connection_test (
    id integer NOT NULL,
    test_name character varying(100),
    status character varying(20),
    message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.circlepay_connection_test OWNER TO postgres;

--
-- Name: circlepay_connection_test_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.circlepay_connection_test_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.circlepay_connection_test_id_seq OWNER TO postgres;

--
-- Name: circlepay_connection_test_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.circlepay_connection_test_id_seq OWNED BY public.circlepay_connection_test.id;


--
-- Name: kyc_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kyc_documents (
    id integer NOT NULL,
    user_id integer NOT NULL,
    document_type character varying(50) NOT NULL,
    document_number character varying(100),
    full_name character varying(200),
    date_of_birth character varying(10),
    nationality character varying(2),
    gender character varying(10),
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state_province character varying(100),
    postal_code character varying(20),
    country character varying(2),
    occupation character varying(100),
    employer character varying(200),
    income_range character varying(50),
    source_of_funds character varying(100),
    file_url character varying(500),
    file_type character varying(20),
    file_size integer,
    verification_status character varying(20),
    verification_method character varying(50),
    verification_notes text,
    verified_by character varying(100),
    verified_at timestamp with time zone,
    compliance_check_id character varying(255),
    risk_score numeric(3,2),
    risk_factors text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    expires_at timestamp with time zone
);


ALTER TABLE public.kyc_documents OWNER TO postgres;

--
-- Name: kyc_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.kyc_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.kyc_documents_id_seq OWNER TO postgres;

--
-- Name: kyc_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.kyc_documents_id_seq OWNED BY public.kyc_documents.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    transaction_id character varying(255) NOT NULL,
    transaction_hash character varying(66),
    transaction_type character varying(20) NOT NULL,
    status character varying(20),
    amount numeric(18,6) NOT NULL,
    currency character varying(10),
    usd_amount numeric(18,6),
    local_amount numeric(18,6),
    local_currency character varying(3),
    source_chain character varying(50),
    target_chain character varying(50),
    source_address character varying(42),
    target_address character varying(42),
    gas_fee numeric(18,6),
    service_fee numeric(18,6),
    total_fee numeric(18,6),
    merchant_id character varying(255),
    merchant_name character varying(255),
    qr_code_id character varying(255),
    extra_metadata text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    wallet_id integer
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.transactions_id_seq OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20),
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    country_code character varying(2) NOT NULL,
    preferred_currency character varying(10),
    circle_wallet_id character varying(255),
    circle_entity_id character varying(255),
    is_verified boolean,
    is_active boolean,
    pin_hash character varying(255),
    kyc_status character varying(20),
    kyc_level integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    last_login_at timestamp with time zone,
    circle_wallet_set_id character varying(255),
    primary_wallet_id character varying(255)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    circle_wallet_id character varying(255) NOT NULL,
    wallet_address character varying(42),
    chain_id integer NOT NULL,
    chain_name character varying(50) NOT NULL,
    usdc_balance numeric(18,6),
    last_balance_update timestamp with time zone,
    is_active boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE public.wallets OWNER TO postgres;

--
-- Name: wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wallets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.wallets_id_seq OWNER TO postgres;

--
-- Name: wallets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wallets_id_seq OWNED BY public.wallets.id;


--
-- Name: circlepay_connection_test id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.circlepay_connection_test ALTER COLUMN id SET DEFAULT nextval('public.circlepay_connection_test_id_seq'::regclass);


--
-- Name: kyc_documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_documents ALTER COLUMN id SET DEFAULT nextval('public.kyc_documents_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: wallets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets ALTER COLUMN id SET DEFAULT nextval('public.wallets_id_seq'::regclass);


--
-- Name: circlepay_connection_test circlepay_connection_test_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.circlepay_connection_test
    ADD CONSTRAINT circlepay_connection_test_pkey PRIMARY KEY (id);


--
-- Name: kyc_documents kyc_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_documents
    ADD CONSTRAINT kyc_documents_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_transaction_id_key UNIQUE (transaction_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_circle_wallet_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_circle_wallet_id_key UNIQUE (circle_wallet_id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: idx_transactions_wallet_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_wallet_id ON public.transactions USING btree (wallet_id);


--
-- Name: idx_users_primary_wallet_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_primary_wallet_id ON public.users USING btree (primary_wallet_id);


--
-- Name: ix_kyc_documents_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_kyc_documents_id ON public.kyc_documents USING btree (id);


--
-- Name: ix_kyc_documents_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_kyc_documents_user_id ON public.kyc_documents USING btree (user_id);


--
-- Name: ix_transactions_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_transactions_id ON public.transactions USING btree (id);


--
-- Name: ix_transactions_transaction_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_transactions_transaction_hash ON public.transactions USING btree (transaction_hash);


--
-- Name: ix_transactions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_transactions_user_id ON public.transactions USING btree (user_id);


--
-- Name: ix_users_circle_entity_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_circle_entity_id ON public.users USING btree (circle_entity_id) WHERE ((circle_entity_id IS NOT NULL) AND ((circle_entity_id)::text <> ''::text));


--
-- Name: ix_users_circle_wallet_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_circle_wallet_id ON public.users USING btree (circle_wallet_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: ix_users_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_phone ON public.users USING btree (phone);


--
-- Name: ix_wallets_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_wallets_id ON public.wallets USING btree (id);


--
-- Name: ix_wallets_user_chain; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_wallets_user_chain ON public.wallets USING btree (user_id, chain_id);


--
-- Name: ix_wallets_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_wallets_user_id ON public.wallets USING btree (user_id);


--
-- Name: ix_wallets_wallet_address_non_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_wallets_wallet_address_non_unique ON public.wallets USING btree (wallet_address);


--
-- Name: transactions fk_transactions_wallet_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transactions_wallet_id FOREIGN KEY (wallet_id) REFERENCES public.wallets(id);


--
-- Name: kyc_documents kyc_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_documents
    ADD CONSTRAINT kyc_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: wallets wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--


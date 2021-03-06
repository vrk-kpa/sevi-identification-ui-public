import React from 'react';
import PropTypes from 'prop-types';
import browserHistory from 'react-router/lib/browserHistory';

import Translated from '../Translated.js';
import AuthSelection from './AuthSelection.js';
import Disruption from './Disruption.js';
import IDPLink from '../IDPLink.js';
import * as Utils from '../utils.js';
import {MetadataService} from '../MetadataService.js';
import CountrySelection from './CountrySelection.js';
import AuthPageFrame from '../AuthPageFrame.js';
import TLSCheck from './TLSCheck.js';

let defaultDiscoTimeoutSecs = 295;

let defaultApiProvidersPath =  '/api/metadata/?type=AUTHENTICATION_PROVIDER';
let defaultApiCountryPath = '/api/country';

let countryList = null;
let providers = null;
let metadataService = null;

// eslint-disable-next-line react/no-multi-comp
class DiscoveryPage extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            metadataFetched: metadataService ? true : false,
            providersFetched: providers ? true : false,
            countriesFetched: countryList ? true : false,
        };
    }

    getConfig() {
        return window.IdentificationConfig;
    }
    getEntityId() {
        var entId = this.context.queryParams.entityId;
        return entId;
    }
    getAuthMethods() {
        var authMethods = this.context.queryParams.authMethdReq;
        return authMethods;
    }

    getTimeout() {
        let timeout = this.context.queryParams.timeout || defaultDiscoTimeoutSecs;
        return timeout * 1000;
    }
    isIdentificationCancelled() {
        return this.context.queryParams.msg === 'cancel';
    }
    canUseSessionStorage() {
        try {
            sessionStorage.setItem('__storeTest__', '__storeTest__');
            sessionStorage.removeItem('__storeTest__');
            return true;
        } catch (e) {
            return false;
        }
    }
    storeCancelPath(cancelPath) {
        sessionStorage.setItem('cancelStorage', cancelPath);
    }
    getAndClearCancelPath() {
        let path = sessionStorage.getItem('cancelStorage');
        sessionStorage.removeItem('cancelStorage');
        return path;
    }
    getCancelPath() {
        if (this.canUseSessionStorage()) {
            return this.getAndClearCancelPath() || '/sivut/500/';
        } else {
            return '/sivut/500/';
        }
    }

    getMetadata() {
        metadataService = MetadataService.getInstance();
        metadataService.loadMetadata(this.getEntityId(),
            () => { this.setState({metadataFetched: true}); },
            () => {
                window.location.href = `/sivut/500/?m=reactMetadata&t=${this.props.tag}`;
            });
    }

    getProviders() {
        let config = this.getConfig();
        let path = (config && config.apiProvidersPath) ? config.apiProvidersPath : defaultApiProvidersPath;

        Utils.getJsonData(path, (data) => {
            providers = data;
            this.setState({providersFetched: true}, () => {});
        }, () => {
            window.location.href = `/sivut/500/?m=reactProviders&t=${this.props.tag}`;
        });
    }
    getCountries() {
        let config = this.getConfig();
        let path = (config && config.apiCountryPath) ? config.apiCountryPath : defaultApiCountryPath;
        Utils.getJsonData(path, (data) => {
            countryList = data;
            this.setState({countriesFetched: true});
        }, () => {
            window.location.href = `/sivut/500/?m=reactCountries&t=${this.props.tag}`;
        });
    }
    componentWillMount() {
        if (!this.isIdentificationCancelled()) {
            if (this.canUseSessionStorage()) {
                this.storeCancelPath(this.props.location.search);
            }
        } else {
            window.location.href = this.getCancelPath();
        }
    }
    componentDidMount() {
        if (!this.isIdentificationCancelled()) {
            if (!this.state.metadataFetched) {
                this.getMetadata();
            }
            if (!this.state.providersFetched) {
                this.getProviders();
            }
            if (this.props.location.pathname === '/sivut/country-selection/') {
                if (!this.state.countriesFetched) {
                    this.getCountries();
                }
            }
        }
    }
    componentWillReceiveProps(nextProps) {
        if (nextProps.location.pathname === '/sivut/country-selection/' && countryList === null) {
            this.getCountries();
        }
    }

    cancelAndReturnToService() {
        let path = Utils.getReturnLinkUrl('cancel', this.context.queryParams);
        window.location = path;
    }

    getDiscoPageContent(allowedProviderEntityIds, eidasSupport) {
        return (
            <div className="row">
                <TLSCheck config={this.getConfig()}/>
                <AuthSelection authMethods={allowedProviderEntityIds}
                                availableProviders={providers}
                                config={this.getConfig()}
                                eidasSupport={eidasSupport} />
                <div className="row">
                    <IDPLink status="cancel">
                        <Translated tag="span" id="valinta__return-link" />
                    </IDPLink>
                </div>
            </div>
        );
    }
    getFlagPageContent() {
        return (
            <div className="row">
                <CountrySelection availableCountries={countryList}
                                  authMethods={this.getAuthMethods()}
                                  eidasSupport={metadataService.getEidasSupport()} />
                <div className="row">
                    <a onClick={browserHistory.goBack} className="go-back">
                        <Translated tag="span" id="valinta__palaa_tunnistajan_valintaan" />
                    </a>
                </div>
            </div>
        );
    }

    storeServiceDisplayNameForFeedback(serviceDisplayName) {
        if (window.sessionStorage) {
            sessionStorage.setItem('serviceDisplayNameForFeedback', serviceDisplayName);
        }
    }

    render() {
        let onDiscoPage = true;
        let onCountrySelection = false;
        const {disruptionUrl, eidasDisruptionUrl} = this.getConfig();

        if (this.props.location.pathname === '/sivut/country-selection/') {
            onDiscoPage = false;
            onCountrySelection = true;
        }
        // Check that needed data from backend has been loaded before rendering
        if (onDiscoPage && (!this.state.metadataFetched || !this.state.providersFetched)) {
            return null;
        } else if (!onDiscoPage && !this.state.countriesFetched) {
            return null;
        }

        let eidasSupport = metadataService.getEidasSupport();
        let serviceDisplayName = metadataService.getServiceDisplayName(this.context.lang);
        let allowedAuthProviders = metadataService.getAllowedAuthProviders(this.context.queryParams.authMethdReq, providers);
        if (allowedAuthProviders.length === 0) {
            this.cancelAndReturnToService();
            return null;
        }

        this.storeServiceDisplayNameForFeedback(serviceDisplayName);

        var discoTimer = Utils.DiscoTimer.getInstance();
        if (!discoTimer.isTimerOn()) {
            discoTimer.addTimerListener((timerContext) => {
                let url = '/idp/authn/External?status=timeout';
                url = timerContext.tid ? url + '&tid=' + timerContext.tid : url;
                url = timerContext.pid ? url + '&pid=' + timerContext.pid : url;
                url = timerContext.tag ? url + '&tag=' + timerContext.tag : url;
                url = timerContext.conversation ? url + '&conversation=' + timerContext.conversation : url;
                window.location = url;
            }, {tid: this.context.queryParams.tid, pid: this.context.queryParams.pid, tag: this.context.queryParams.tag, conversation: this.context.queryParams.conversation});
            discoTimer.startTimer(this.getTimeout());
        }


        return (
            <main id="main" role="main" name="main">
                <div className="main">
                    <div className="container">
                        <AuthPageFrame serviceDisplayName={serviceDisplayName}>
                            <div>
                                <Disruption id='disruption' path={disruptionUrl}/>
                                { onCountrySelection ? <Disruption id='disruption-eidas' path={eidasDisruptionUrl}/> : '' }
                            </div>
                        </AuthPageFrame>
                        { (onDiscoPage) ? this.getDiscoPageContent(allowedAuthProviders, eidasSupport) : this.getFlagPageContent() }
                    </div>
                </div>
            </main>
        );
    }
}

DiscoveryPage.propTypes = {
    location: PropTypes.object,
    tag: PropTypes.string
};

DiscoveryPage.defaultProps = {
    tag: ''
};

DiscoveryPage.contextTypes = {
    router: PropTypes.object.isRequired,
    queryParams: PropTypes.object.isRequired,
    lang: PropTypes.string.isRequired
};

export default DiscoveryPage;

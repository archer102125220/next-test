import { Component } from 'React';
import PropTypes from 'prop-types';
import '../styles/globals.css';

export default class MyApp extends Component {
  constructor(props){
    super(props)
  }

  state = {}

  render() {
    const { Component, pageProps } = this.props;
    return <Component {...pageProps} />;
  }
  static propTypes = {
    pageProps: PropTypes.any,
    Component: PropTypes.any
  }
}

import React, { Component, PropTypes } from 'react';
import Radium from './OptionalRadium';
import defaultStyle from 'substyle';

import utils from './utils';

import Suggestion from './Suggestion';
import LoadingIndicator from './LoadingIndicator';

class SuggestionsOverlay extends Component {

  static propTypes = {
    suggestions: PropTypes.object.isRequired,
    focusIndex: PropTypes.number,
    scrollFocusedIntoView: PropTypes.bool,
    isLoading: PropTypes.bool,
    onSelect: PropTypes.func,
  };

  static defaultProps = {
    suggestions: {},
    onSelect: () => null,
  };

  componentDidUpdate() {
    const { suggestions } = this.refs;
    const focused = suggestions && suggestions.children[this.props.focusIndex];
    const container = suggestions && suggestions.offsetParent;

    if (!container || !focused || !this.props.scrollFocusedIntoView) {
      // console.log('mentions.overlay.update.skip', container && [container.scrollTop, container.offsetHeight, container.scrollHeight],
      //   {...this.props, focused, container, suggestions})
      return;
    }

    const { scrollTop, offsetHeight } = container;
    const rectFocused = focused.getBoundingClientRect();
    const rectContainer = container.getBoundingClientRect();
    const overscan = rectFocused.height * 0.618;
    const scrollTopMax = scrollTop + rectFocused.top - rectContainer.top - overscan;
    const scrollTopMin = scrollTop + rectFocused.bottom - rectContainer.top - offsetHeight + overscan;

    if (scrollTop < scrollTopMin) {
      container.scrollTop = scrollTopMin;
    } else if (scrollTop > scrollTopMax) {
      container.scrollTop = scrollTopMax;
    }

    // console.log('mentions.overlay.update', {rectFocused, rectContainer, scrollTop, offsetHeight, scrollTopMin, scrollTopMax,
    //   scrollTopNew: container.scrollTop, focused, container, suggestions})
  }

  render() {
    // do not show suggestions until there is some data
    if(utils.countSuggestions(this.props.suggestions) === 0 && !this.props.isLoading) {
      return null;
    }

    // console.log('mentions.overlay.render', substyle(this.props).style, substyle(this.props, "list").style, this.props,
    //   this.refs.suggestions && this.refs.suggestions.children[this.props.focusIndex].getBoundingClientRect())

    return (
      <div
        {...substyle(this.props)}
        onMouseDown={this.props.onMouseDown}>

        <ul ref="suggestions"
          {...substyle(this.props, "list") }>
          { this.renderSuggestions() }
        </ul>

        { this.renderLoadingIndicator() }
      </div>
    );
  }

  renderSuggestions() {
    return utils.getSuggestions(this.props.suggestions).reduce((result, { suggestions, descriptor }) => [
      ...result,

      ...suggestions.map((suggestion, index) => this.renderSuggestion(
        suggestion,
        descriptor,
        result.length + index
      ))
    ], []);
  }

  renderSuggestion(suggestion, descriptor, index) {
    let id = this.getID(suggestion);
    let isFocused = (index === this.props.focusIndex);

    let { mentionDescriptor, query } = descriptor;

    return (
      <Suggestion { ...substyle(this.props, "item") }
        key={ id }
        id={ id }
        ref={isFocused ? "focused" : null}
        query={ query }
        index={ index }
        descriptor={ mentionDescriptor }
        suggestion={ suggestion }
        focused={ isFocused }
        onClick={ () => this.select(suggestion, descriptor) }
        onMouseEnter={ () => this.handleMouseEnter(index) } />
    );
  }

  getID(suggestion) {
    if(suggestion instanceof String) {
      return suggestion;
    }

    return suggestion.id;
  }

  renderLoadingIndicator () {
    if(!this.props.isLoading) {
      return;
    }

    return <LoadingIndicator { ...substyle(this.props, "loadingIndicator") } />
  }

  handleMouseEnter(index, ev) {
    if(this.props.onMouseEnter) {
      this.props.onMouseEnter(index);
    }
  }

  select(suggestion, descriptor) {
    this.props.onSelect(suggestion, descriptor);
  }

};

export default Radium(SuggestionsOverlay);

const substyle = defaultStyle({
  style: {
    position: "absolute",
    zIndex: 1,
    backgroundColor: "white",
    marginTop: 14,
    minWidth: 100,

    list: {
      margin: 0,
      padding: 0,
      listStyleType: "none",
    }
  }
});
